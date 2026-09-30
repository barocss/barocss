import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { buildCliArgv, buildCliPrompt, MODEL, MAX_DISPATCHES, PER_CALL_TIMEOUT_MS,
  TOTAL_TIMEOUT_MS, PRIVATE_ROOT, PROMPT_VERSION, PROMPT_CONTRACT_SHA256 } from './cli-profile.mjs';

const sessionIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const eventTypes = new Set(['thread.started', 'turn.started', 'turn.completed', 'turn.failed',
  'item.started', 'item.updated', 'item.completed', 'error']);
const CODE_MODE_NOTICE = 'Code Mode is unavailable because code-mode host is disabled. Code mode will fail closed; enable `features.code_mode_host` and install `codex-code-mode-host`.';
const sha = (value) => createHash('sha256').update(value).digest('hex');
const validationError = (code, message) => Object.assign(new Error(message), { validationCode: code });

export function createCliGenerator({ cliPath, cwd, home, codexHome, nodeBin, schemaPath, outputDir,
  spawnProcess = spawn, clock = () => performance.now() }) {
  for (const value of [cliPath, cwd, home, codexHome, nodeBin, schemaPath, outputDir]) {
    if (typeof value !== 'string' || !path.isAbsolute(value)) throw new Error('Absolute CLI setup paths required');
  }
  if (home !== path.join(cwd, 'home') || schemaPath !== path.join(cwd, 'schema.json')
    || path.dirname(codexHome) !== PRIVATE_ROOT || path.dirname(outputDir) !== PRIVATE_ROOT
    || !path.basename(outputDir).startsWith('private-460-')) throw new Error('Invalid private CLI setup');
  const env = { HOME: home, CODEX_HOME: codexHome, PATH: `${nodeBin}:/usr/bin:/bin`,
    TERM: 'dumb', NO_COLOR: '1', LANG: 'en_US.UTF-8' };
  let dispatches = 0;
  let firstDispatchAt = null;
  let sessionId = null;

  return async function generate(request) {
    if (dispatches >= MAX_DISPATCHES) throw new Error('CLI dispatch ceiling reached');
    if ((dispatches === 0 && request.kind !== 'initial')
      || (dispatches === 1 && (request.kind !== 'next' || request.threadId !== sessionId))) {
      throw new Error('Invalid CLI turn order');
    }
    const prompt = buildCliPrompt(request);
    const finalPath = path.join(outputDir, `${request.kind}-final.txt`);
    const argv = buildCliArgv({ kind: request.kind, cwd, schemaPath, finalPath,
      ...(request.kind === 'next' ? { threadId: sessionId } : {}) });
    if (fs.existsSync(finalPath)) throw new Error('CLI output already exists');
    firstDispatchAt ??= clock();
    const remaining = TOTAL_TIMEOUT_MS - (clock() - firstDispatchAt);
    if (remaining <= 0) throw new Error('CLI total timeout');
    if (request.signal?.aborted) throw new Error('CLI turn cancelled');
    const timeoutMs = Math.min(PER_CALL_TIMEOUT_MS, remaining);
    dispatches++;
    const started = clock();
    const prefix = path.join(outputDir, request.kind);
    const stdoutFd = fs.openSync(`${prefix}-stdout.jsonl`, 'wx', 0o600);
    const stderrFd = fs.openSync(`${prefix}-stderr.txt`, 'wx', 0o600);
    fs.writeFileSync(`${prefix}-prompt.txt`, prompt, { flag: 'wx', mode: 0o600 });
    fs.writeFileSync(`${prefix}-dispatch.json`, JSON.stringify({ kind: request.kind, dispatchNumber: dispatches,
      argv, cliPath, cwd, environmentKeys: Object.keys(env).sort(), timeoutMs,
      promptVersion: PROMPT_VERSION, promptContractSha256: PROMPT_CONTRACT_SHA256,
      promptSha256: sha(prompt),
      startedAt: new Date().toISOString() }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    let child;
    try { child = spawnProcess(cliPath, argv, { cwd, env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] }); }
    catch {
      fs.closeSync(stdoutFd); fs.closeSync(stderrFd);
      fs.writeFileSync(`${prefix}-result.json`, JSON.stringify({ exitCode: null, stopReason: 'spawn-error',
        elapsedMs: Math.round(clock() - started) }) + '\n', { flag: 'wx', mode: 0o600 });
      throw new Error('CLI spawn failed');
    }
    let seenSession = null, turnStarted = false, completed = false, stopReason = null, pending = '', outputBytes = 0;
    let finalEventHash = null, responseModel = null;
    const diagnostics = [];
    let stderrBytes = 0;
    let killTimer;
    const stop = (reason) => {
      if (stopReason) return;
      stopReason = reason;
      if (child.pid) {
        try { process.kill(-child.pid, 'SIGTERM'); }
        catch { try { child.kill('SIGTERM'); } catch { /* already exited */ } }
        killTimer = setTimeout(() => {
          try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already exited */ }
        }, 2000);
        killTimer.unref();
      } else { try { child.kill('SIGTERM'); } catch { /* already exited */ } }
    };
    const onAbort = () => stop('cancelled');
    request.signal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => stop('timeout'), timeoutMs);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      const bytes = Buffer.from(chunk);
      if (outputBytes + bytes.length > 2_000_000) return stop('event-limit');
      fs.writeSync(stdoutFd, bytes);
      outputBytes += bytes.length;
      if (stopReason) return;
      pending += chunk;
      if (Buffer.byteLength(pending) > 1_000_000) return stop('event-limit');
      let newline;
      while ((newline = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0, newline);
        pending = pending.slice(newline + 1);
        if (!line.trim()) continue;
        let event;
        try { event = JSON.parse(line); } catch { return stop('malformed-event'); }
        if (!event || !eventTypes.has(event.type)) return stop('unknown-event');
        if (typeof event.model === 'string') {
          responseModel = event.model;
          if (event.model !== MODEL) return stop('model-drift');
        }
        if (event.type === 'thread.started') {
          if (typeof event.thread_id !== 'string' || !sessionIdPattern.test(event.thread_id)) {
            return stop('invalid-session-event');
          }
          if (seenSession && seenSession !== event.thread_id) return stop('session-drift');
          seenSession = event.thread_id;
        }
        if (event.type === 'turn.started') turnStarted = true;
        if (event.type.startsWith('item.') && event.item?.type === 'error') {
          if (event.type === 'item.completed' && event.item.message === CODE_MODE_NOTICE
            && !turnStarted && !completed && !diagnostics.includes('code-mode-host-disabled')) {
            diagnostics.push('code-mode-host-disabled');
            continue;
          }
          return stop('cli-diagnostic');
        }
        if (event.type.startsWith('item.') && !['agent_message', 'reasoning'].includes(event.item?.type)) {
          return stop('unexpected-cli-tool');
        }
        if (event.type === 'item.completed' && event.item?.type === 'agent_message'
          && typeof event.item.text === 'string') finalEventHash = sha(event.item.text);
        if (event.type === 'turn.completed') completed = true;
        if (event.type === 'error' || event.type === 'turn.failed') return stop('cli-failed');
      }
    });
    child.stderr.on('data', (chunk) => {
      const bytes = Buffer.from(chunk);
      if (stderrBytes + bytes.length > 65_536) return stop('stderr-limit');
      fs.writeSync(stderrFd, bytes);
      stderrBytes += bytes.length;
    });
    child.stdout.on('error', () => stop('stdout-error'));
    child.stderr.on('error', () => stop('stderr-error'));
    child.stdin.on('error', () => stop('stdin-error'));
    child.stdin.end(prompt);
    let exit;
    try {
      exit = await new Promise((resolve) => {
        child.once('error', () => { stopReason ||= 'spawn-error'; resolve({ code: null }); });
        child.once('close', (code) => resolve({ code }));
      });
    } finally {
      clearTimeout(timer);
      clearTimeout(killTimer);
      request.signal?.removeEventListener('abort', onAbort);
      if (stopReason && child.pid) {
        try { process.kill(-child.pid, 'SIGKILL'); } catch { /* group already exited */ }
      }
      fs.fsyncSync(stdoutFd); fs.closeSync(stdoutFd);
      fs.fsyncSync(stderrFd); fs.closeSync(stderrFd);
    }
    let envelope, failure;
    try {
      if (stopReason || exit.code !== 0 || !completed || !seenSession || pending.trim()) {
        throw validationError('transport-incomplete', `CLI turn failed: ${stopReason ?? 'incomplete'}`);
      }
      if (request.kind === 'next' && seenSession !== sessionId) {
        throw validationError('session-drift', 'CLI session changed');
      }
      if (!fs.existsSync(finalPath)) throw validationError('final-missing', 'CLI final output missing');
      const raw = fs.readFileSync(finalPath, 'utf8');
      if (Buffer.byteLength(raw) > 32_768) throw validationError('final-limit', 'CLI final output too large');
      const finalText = raw.replace(/\r?\n$/, '');
      if (!finalEventHash || finalEventHash !== sha(finalText)) {
        throw validationError('final-event-mismatch', 'CLI final event mismatch');
      }
      try { envelope = JSON.parse(raw); }
      catch { throw validationError('final-json', 'CLI final envelope is not JSON'); }
      if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)
        || Object.keys(envelope).join(',') !== 'specJson' || typeof envelope.specJson !== 'string') {
        throw validationError('final-envelope', 'CLI final envelope is invalid');
      }
    } catch (error) { failure = error; }
    fs.writeFileSync(`${prefix}-result.json`, JSON.stringify({ exitCode: exit.code, stopReason,
      elapsedMs: Math.round(clock() - started), eventBytes: outputBytes, stderrBytes,
      completed, threadId: seenSession, responseModel, finalEventHash, diagnostics,
      validationFailure: failure?.validationCode ?? null }) + '\n', { flag: 'wx', mode: 0o600 });
    if (failure) throw failure;
    if (request.kind === 'initial') sessionId = seenSession;
    return { threadId: seenSession, specJson: envelope.specJson };
  };
}
