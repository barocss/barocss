import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile, statfs } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { here, root, sha, verifyFreeze, bundle } from './bundle.mjs';
import { loadSavedBank } from './bank-reader.mjs';
import { makeSavedPhaseRequest, restoreInputSigns, negativeZeroPaths } from './variants.mjs';
import { assertReply } from './reply-schema.mjs';

export const LIMITS = Object.freeze({ sourcePhases: 6, compiledPhases: 6,
  projectionCalls: 24, reportCalls: 24, positiveIPC: 6, negativeIPC: 2,
  derives: 12, atPrecision: 24, compiledReferenceIPC: 0,
  fixedBytes: 32 * 1024 ** 2, emergencyBytes: 8 * 1024 ** 2,
  requestBytes: 256 * 1024, replyBytes: 2 * 1024 ** 2, stderrBytes: 128 * 1024,
  processMilliseconds: 300000 });
const SNAPSHOTS = ['FIRST', 'LIMIT', 'FINAL'];
const VARIANTS = ['RENAME', 'PERMUTE'];

/** One bounded owner. Loading this module does not start a trial. */
export async function runSavedPhaseQualification(directory) {
  assert.equal(process.versions.node.split('.')[0], '22');
  assert.ok(directory && resolve(directory).startsWith('/workspace/shared/physics1489-evidence/'));
  const freeze = await verifyFreeze({ execution: true });
  await mkdir(directory, { recursive: false });
  const disk = await statfs(directory);
  assert.ok(disk.bavail * disk.bsize > LIMITS.fixedBytes + LIMITS.emergencyBytes, 'insufficient evidence storage');
  let fixedBytes = 0, emergencyBytes = 0;
  let producerThrown = false;
  const retainedUnknown = [];
  const ledger = { kind: 'INTERNAL_PHASE_QUALIFICATION', origin: 'f401-saved-input',
    newPublicExecution: false, publicTrajectoryGO: false, status: 'RUNNING', limits: LIMITS,
    attempted: { sourcePhases: 0, compiledPhases: 0, positiveIPC: 0, negativeIPC: 0, dataProcesses: 0 },
    completed: { sourcePhases: 0, compiledPhases: 0, positiveIPC: 0, negativeIPC: 0, dataProcesses: 0 },
    observedReturnedCalls: { projectionCalls: 0, reportCalls: 0 },
    independentCalls: { deriveAttempted: 0, deriveCompleted: 0, atPrecisionAttempted: 0, atPrecisionCompleted: 0 },
    processes: [], cases: [], files: [], unresolvedCounterPrefixes: [], failure: null };
  async function save(name, value, emergency = false) {
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
    const used = emergency ? emergencyBytes : fixedBytes;
    assert.ok(used + bytes.length <= (emergency ? LIMITS.emergencyBytes : LIMITS.fixedBytes), 'evidence byte budget exhausted');
    await writeFile(resolve(directory, name), bytes, { flag: 'wx' });
    if (emergency) emergencyBytes += bytes.length; else fixedBytes += bytes.length;
    ledger.files.push({ name, bytes: bytes.length, sha256: sha(bytes), emergency });
    return resolve(directory, name);
  }
  async function processFile(command, args, prefix, input, extraEnv = {}, onStart = () => {}) {
    if (input !== null) assert.ok(Buffer.byteLength(input) <= LIMITS.requestBytes, 'request byte budget exhausted');
    const dataOutputReserve = Number(extraEnv.PHYSICS_HINGE_DATA_OUTPUT_MAX_BYTES ?? 0);
    assert.ok(Number.isSafeInteger(dataOutputReserve) && dataOutputReserve >= 0 && dataOutputReserve <= LIMITS.replyBytes);
    assert.ok(fixedBytes + (input === null ? 0 : Buffer.byteLength(input)) + LIMITS.replyBytes + LIMITS.stderrBytes + dataOutputReserve + 4096 <= LIMITS.fixedBytes, 'insufficient reserved process storage');
    await save(`${prefix}.stdin.raw`, input ?? '');
    const stdout = [], stderr = [];
    let stdoutBytes = 0, stderrBytes = 0, capturedStdoutBytes = 0, capturedStderrBytes = 0;
    let overflow = null, spawnError = null, stdinError = null;
    const started = Date.now();
    onStart();
    const child = spawn(command, args, { cwd: root, env: { ...process.env,
      PYTHONDONTWRITEBYTECODE: '1', PHYSICS_HINGE_BANK_FILE: resolve(directory, 'bank.json'),
      PHYSICS_HINGE_COUNTER_FILE: resolve(directory, `${prefix}.counts.json`), ...extraEnv },
      stdio: ['pipe', 'pipe', 'pipe'] });
    const timer = setTimeout(() => { overflow = 'process time budget exhausted'; child.kill('SIGKILL'); }, LIMITS.processMilliseconds);
    child.stdout.on('data', bytes => {
      stdoutBytes += bytes.length;
      const kept = bytes.subarray(0, Math.max(0, LIMITS.replyBytes - capturedStdoutBytes));
      if (kept.length) { stdout.push(kept); capturedStdoutBytes += kept.length; }
      if (stdoutBytes > LIMITS.replyBytes) { overflow = 'stdout byte budget exhausted'; child.kill('SIGKILL'); }
    });
    child.stderr.on('data', bytes => {
      stderrBytes += bytes.length;
      const kept = bytes.subarray(0, Math.max(0, LIMITS.stderrBytes - capturedStderrBytes));
      if (kept.length) { stderr.push(kept); capturedStderrBytes += kept.length; }
      if (stderrBytes > LIMITS.stderrBytes) { overflow = 'stderr byte budget exhausted'; child.kill('SIGKILL'); }
    });
    const closed = new Promise(accept => {
      child.on('error', error => { spawnError = { code: error.code, message: error.message }; });
      child.stdin.on('error', error => { stdinError = { code: error.code, message: error.message }; });
      child.on('close', (code, signal) => accept({ code, signal }));
    });
    child.stdin.end(input ?? undefined);
    let exit;
    try { exit = await closed; } finally { clearTimeout(timer); }
    const out = Buffer.concat(stdout), err = Buffer.concat(stderr);
    const receipt = { prefix, command, args, inputBytes: input === null ? 0 : Buffer.byteLength(input),
      stdoutBytes, stderrBytes, capturedStdoutBytes, capturedStderrBytes,
      stdoutTruncatedBytes: stdoutBytes - capturedStdoutBytes, stderrTruncatedBytes: stderrBytes - capturedStderrBytes,
      ...exit, overflow, spawnError, stdinError, milliseconds: Date.now() - started };
    ledger.processes.push(receipt);
    const failed = overflow !== null || spawnError !== null || stdinError !== null || exit.code !== 0 || exit.signal !== null;
    await save(`${prefix}.stdout.raw`, out, failed);
    await save(`${prefix}.stderr.raw`, err, failed);
    assert.equal(spawnError, null, 'child launch failure');
    assert.equal(stdinError, null, 'child input pipe failure');
    assert.equal(overflow, null);
    assert.equal(exit.code, 0, 'child nonzero');
    assert.equal(exit.signal, null, 'child signaled');
    return out;
  }
  async function collectCounts(prefix) {
    const countsBytes = await readFile(resolve(directory, `${prefix}.counts.json`));
    fixedBytes += countsBytes.length;
    assert.ok(fixedBytes <= LIMITS.fixedBytes);
    ledger.files.push({ name: `${prefix}.counts.json`, bytes: countsBytes.length, sha256: sha(countsBytes), emergency: false });
    const counts = JSON.parse(countsBytes);
    assert.deepEqual(Object.keys(counts).sort(), Object.keys(ledger.independentCalls).sort());
    for (const key of Object.keys(counts)) {
      assert.ok(Number.isSafeInteger(counts[key]) && counts[key] >= 0);
      ledger.independentCalls[key] += counts[key];
      assert.ok(ledger.independentCalls[key] <= (key.startsWith('derive') ? LIMITS.derives : LIMITS.atPrecision));

    }
    return counts;
  }
  async function ipc(request, prefix, negative) {
    const count = negative ? 'negativeIPC' : 'positiveIPC';
    assert.ok(ledger.attempted[count] < LIMITS[count], 'IPC count exhausted');
    let raw;
    try { raw = await processFile('python3', [resolve(here, 'reference.py')], prefix, JSON.stringify(request) + '\n', {}, () => { ledger.attempted[count]++; }); }
    catch (error) {
      try { await collectCounts(prefix); } catch { ledger.unresolvedCounterPrefixes.push(prefix); }
      throw error;
    }
    const counts = await collectCounts(prefix);
    assert.ok(raw.length > 0 && raw.at(-1) === 10, 'partial EOF');
    const lines = new TextDecoder('utf-8', { fatal: true }).decode(raw).split('\n');
    assert.equal(lines.length, 2, 'expected exactly one complete reply');
    const reply = JSON.parse(lines[0]);
    assertReply(reply);
    for (const key of Object.keys(counts)) assert.equal(counts[key], negative ? 0 : key.startsWith('derive') ? 2 : 4);
    ledger.completed[count]++;
    if (negative) {
      assert.deepEqual(reply.error, { code: 'REFERENCE_INPUT', message: 'hinge world reference input is invalid' });
      assert.equal(reply.referenceStatus, 'UNRESOLVED');
    } else {
      if (reply.referenceStatus !== 'RETURN') ledger.stopKind = reply.referenceStatus === 'MISMATCH' ? 'PHYSICAL_MISMATCH' : 'EXECUTION_FAILURE';
      assert.equal(reply.referenceStatus, 'RETURN', 'first independent non-RETURN');
      assert.equal(reply.ok, true);
    }
    return reply;
  }
  try {
    let bank;
    if (freeze.bankReuse) {
      const bytes = await readFile(freeze.bankReuse.path);
      assert.equal(bytes.length, freeze.bankReuse.bytes);
      assert.equal(sha(bytes), freeze.bankReuse.sha256);
      bank = JSON.parse(bytes);
    } else bank = await loadSavedBank({ repositoryRoot: root });
    await save('bank.json', bank);
    const sourceGraph = await bundle('source', directory);
    const compiledGraph = await bundle('compiled', directory);
    for (const graph of ['source', 'compiled']) for (const suffix of ['phase.mjs', 'metafile.json', 'provenance.json']) {
      const name = `${graph}-${suffix}`, bytes = await readFile(resolve(directory, name));
      fixedBytes += bytes.length;
      assert.ok(fixedBytes <= LIMITS.fixedBytes);
      ledger.files.push({ name, bytes: bytes.length, sha256: sha(bytes), emergency: false });
    }
    const source = await import(pathToFileURL(sourceGraph.outfile).href);
    const compiled = await import(pathToFileURL(compiledGraph.outfile).href);
    // Schema controls consume no producer phase and no parent arithmetic.
    const duplicate = makeSavedPhaseRequest(bank, 'FIRST', 'RENAME', null);
    duplicate.sourceState.bodies[1].id = duplicate.sourceState.bodies[0].id;
    await ipc(duplicate, 'negative-duplicate', true);
    const wrongRaw = makeSavedPhaseRequest(bank, 'FIRST', 'PERMUTE', null);
    wrongRaw.sourceRawHex = bank.snapshots.FIRST.sourceRawHex;
    await ipc(wrongRaw, 'negative-raw-order', true);
    for (const snapshot of SNAPSHOTS) for (const variant of VARIANTS) {
      const key = `${snapshot}-${variant}`;
      const request = makeSavedPhaseRequest(bank, snapshot, variant, null);
      const restored = restoreInputSigns(request);
      assert.ok(fixedBytes + LIMITS.replyBytes + LIMITS.stderrBytes + 2 * LIMITS.requestBytes + 4096 <= LIMITS.fixedBytes, 'insufficient SOURCE phase storage');
      assert.ok(ledger.attempted.sourcePhases < LIMITS.sourcePhases);
      ledger.attempted.sourcePhases++;
      let actual;
      try { actual = source.runSavedPhase(restored, [...bank.snapshots[snapshot].locators.motorJ]); }
      catch (value) { producerThrown = true; retainedUnknown.push(value); throw value; }
      ledger.completed.sourcePhases++;
      for (const field of ['projectionCalls', 'reportCalls']) {
        assert.equal(actual.calls[field], 2);
        ledger.observedReturnedCalls[field] += actual.calls[field];
        assert.ok(ledger.observedReturnedCalls[field] <= LIMITS[field]);
      }
      request.actual = actual;
      request.negativeZeroPaths.actual = negativeZeroPaths(actual);
      const requestFile = await save(`${key}.source-request.json`, request);
      await ipc(request, `${key}.source`, false);
      const replyFile = resolve(directory, `${key}.source.stdout.raw`);
      ledger.cases.push({ snapshot, variant, source: 'RETURN', compiled: null });
      // Compiled uses actual emitted product code and the already authenticated SOURCE expected data.
      assert.ok(fixedBytes + 2 * LIMITS.replyBytes + LIMITS.stderrBytes + LIMITS.requestBytes + 4096 <= LIMITS.fixedBytes, 'insufficient compiled phase storage');
      assert.ok(ledger.attempted.compiledPhases < LIMITS.compiledPhases);
      ledger.attempted.compiledPhases++;
      let compiledActual;
      try { compiledActual = compiled.runSavedPhase(restoreInputSigns(makeSavedPhaseRequest(bank, snapshot, variant, null)),
        [...bank.snapshots[snapshot].locators.motorJ]); }
      catch (value) { producerThrown = true; retainedUnknown.push(value); throw value; }
      ledger.completed.compiledPhases++;
      for (const field of ['projectionCalls', 'reportCalls']) {
        assert.equal(compiledActual.calls[field], 2);
        ledger.observedReturnedCalls[field] += compiledActual.calls[field];
        assert.ok(ledger.observedReturnedCalls[field] <= LIMITS[field]);
      }
      const actualFile = await save(`${key}.compiled-actual.json`, {
        actual: compiledActual, negativeZeroPaths: negativeZeroPaths(compiledActual) });
      const comparisonFile = resolve(directory, `${key}.compiled-reply.json`);
      await processFile('python3', [resolve(here, 'actual-compare.py'), '--source-request', requestFile, '--source-reply', replyFile, '--actual', actualFile, '--output', comparisonFile],
        `${key}.compiled-data`, null, {
          PHYSICS_HINGE_SOURCE_REQUEST_SHA256: ledger.files.find(file => file.name === `${key}.source-request.json`).sha256,
          PHYSICS_HINGE_SOURCE_REPLY_SHA256: ledger.files.find(file => file.name === `${key}.source.stdout.raw`).sha256,
          PHYSICS_HINGE_DATA_OUTPUT_MAX_BYTES: String(Math.min(LIMITS.replyBytes, LIMITS.fixedBytes - fixedBytes - LIMITS.replyBytes - LIMITS.stderrBytes - 4096)) },
        () => { ledger.attempted.dataProcesses++; });
      const dataReplyBytes = await readFile(comparisonFile);
      fixedBytes += dataReplyBytes.length;
      assert.ok(fixedBytes <= LIMITS.fixedBytes);
      ledger.files.push({ name: `${key}.compiled-reply.json`, bytes: dataReplyBytes.length, sha256: sha(dataReplyBytes), emergency: false });
      const dataReply = JSON.parse(dataReplyBytes);
      assertReply(dataReply);
      if (dataReply.referenceStatus !== 'RETURN') ledger.stopKind = dataReply.referenceStatus === 'MISMATCH' ? 'PHYSICAL_MISMATCH' : 'EXECUTION_FAILURE';
      assert.equal(dataReply.referenceStatus, 'RETURN');
      assert.equal(dataReply.ok, true);
      ledger.completed.dataProcesses++;
      ledger.cases.at(-1).compiled = 'RETURN';
    }
    assert.deepEqual(ledger.completed, { sourcePhases: 6, compiledPhases: 6,
      positiveIPC: 6, negativeIPC: 2, dataProcesses: 6 });
    assert.deepEqual(ledger.observedReturnedCalls, { projectionCalls: 24, reportCalls: 24 });
    assert.deepEqual(ledger.independentCalls, { deriveAttempted: 12, deriveCompleted: 12, atPrecisionAttempted: 24, atPrecisionCompleted: 24 });
    ledger.status = 'RETURN';
  } catch (error) {
    ledger.status = 'STOPPED';
    ledger.stopKind ??= 'EXECUTION_FAILURE';
    // Internal harness diagnostics only. Never coerce a producer thrown value into a wire DTO.
    ledger.failure = producerThrown ? { producerThrown: true, retainedInMemory: retainedUnknown.length } : error instanceof Error ? { name: error.name, message: error.message } : { unknownThrownValue: true };
    await save('failure-ledger.json', { ...ledger, fixedBytes, emergencyBytes }, true);
    throw error;
  } finally {
    await save('final-ledger.json', { ...ledger, fixedBytes, emergencyBytes }, true);
  }
  return ledger;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(here, 'run-saved-phase.mjs')) {
  if (process.argv.length !== 3) throw new Error('one fresh evidence directory is required');
  await runSavedPhaseQualification(process.argv[2]);
}
