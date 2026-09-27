// Codex CLI agent transport. The reviewed live gate is in agent-live.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { buildAgentArgv, summarizeAgentEvent, agentCliVersion } from './agent-profile.mjs';
import { MODEL, PER_ATTEMPT_TIMEOUT_MS, REASONING } from './plan.mjs';

const sha = (value) => createHash('sha256').update(value).digest('hex');
export function agentEnv({ home, codexHome, nodeBin }) {
  if (![home, codexHome, nodeBin].every(path.isAbsolute)) throw new Error('Absolute agent environment paths required');
  return { HOME: home, CODEX_HOME: codexHome, PATH: `${nodeBin}:/usr/bin:/bin`, TERM: 'dumb', NO_COLOR: '1', LANG: 'en_US.UTF-8' };
}
function stopGroup(child) {
  if (!child.pid) return;
  try { process.kill(-child.pid, 'SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch { /* exited */ } }
  const timer = setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* exited */ } }, 2000);
  timer.unref();
  return timer;
}
export async function runAgentCodex({ cliPath, cwd, home, codexHome, nodeBin, schemaPath, attemptDir, prompt, timeoutMs = PER_ATTEMPT_TIMEOUT_MS }) {
  if (JSON.stringify(fs.readdirSync(cwd).sort()) !== JSON.stringify(['home', 'schema.json'])) throw new Error('Agent scratch contents changed');
  if (!fs.statSync(path.join(cwd, 'home')).isDirectory()) throw new Error('Agent HOME missing');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > PER_ATTEMPT_TIMEOUT_MS) throw new Error('Invalid timeout');
  const finalPath = path.join(attemptDir, 'raw-final.txt');
  const eventsPath = path.join(attemptDir, 'events.jsonl');
  if (fs.existsSync(finalPath) || fs.existsSync(eventsPath)) throw new Error('Attempt output already exists');
  const fd = fs.openSync(eventsPath, 'wx', 0o600);
  const args = buildAgentArgv({ cwd, schemaPath, finalPath });
  const env = agentEnv({ home, codexHome, nodeBin });
  const started = performance.now();
  let child;
  let pending = '';
  let stop = null;
  let usage = null;
  let responseModel = null;
  let eventCount = 0;
  let toolCount = 0;
  let completed = false;
  let finalHash = null;
  let stderrClass = null;
  let stderrTail = '';
  let killTimer;
  try {
    child = spawn(cliPath, args, { cwd, env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const stopNow = (reason) => { if (!stop) { stop = reason; killTimer = stopGroup(child); } };
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      pending += chunk;
      if (Buffer.byteLength(pending) > 1_000_000) return stopNow('event-buffer-limit');
      let split;
      while ((split = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0, split); pending = pending.slice(split + 1);
        if (!line.trim()) continue;
        try {
          const event = summarizeAgentEvent(line);
          if (event.model && event.model !== MODEL) return stopNow('model-drift');
          if (event.model) responseModel = event.model;
          if (event.usage) usage = event.usage;
          if (event.type === 'turn.completed') completed = true;
          if (event.type === 'turn.failed') stopNow(event.errorClass ?? 'turn-failed');
          if (event.itemType === 'command_execution' && event.type === 'item.completed') toolCount++;
          if (event.itemType === 'agent_message' && event.type === 'item.completed') finalHash = event.textSha256 ?? null;
          if (event.errorClass && ['quota', 'billing', 'auth', 'approval-or-sandbox'].includes(event.errorClass)) stopNow(event.errorClass);
          fs.writeSync(fd, JSON.stringify(event) + '\n'); fs.fsyncSync(fd); eventCount++;
        } catch (error) { stopNow(String(error.message).slice(0, 80)); }
      }
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      const message = (stderrTail + String(chunk)).slice(-16_384);
      stderrTail = message.slice(-256);
      const failure = /quota|rate.limit/i.test(message) ? 'quota'
        : /bill|credit|payment/i.test(message) ? 'billing'
        : /auth|login|credential/i.test(message) ? 'auth'
        : /approval|permission|denied|sandbox/i.test(message) ? 'approval-or-sandbox' : null;
      if (failure) { stderrClass = failure; stopNow(failure); }
    });
    child.stdout.on('error', () => stopNow('stdout-error'));
    child.stderr.on('error', () => stopNow('stderr-error'));
    child.stdin.on('error', () => stopNow('stdin-error'));
    child.stdin.end(prompt);
    const timer = setTimeout(() => stopNow('timeout'), timeoutMs);
    let drainTimer;
    const exit = await new Promise((resolve) => {
      let spawnError = null;
      child.once('error', (error) => { spawnError = error.code || 'spawn-error'; stopNow(spawnError); });
      child.once('exit', () => {
        drainTimer = setTimeout(() => {
          stopNow('stdio-drain-timeout');
          child.stdout.destroy(); child.stderr.destroy();
        }, 2000);
      });
      child.once('close', (code, signal) => resolve({ code, signal, spawnError }));
    });
    clearTimeout(timer);
    clearTimeout(drainTimer);
    if (stop && child.pid) {
      clearTimeout(killTimer);
      try { process.kill(-child.pid, 'SIGKILL'); } catch { /* group already exited */ }
    }
    if (pending.trim()) stop ||= 'incomplete-event-line';
    const rawFinal = fs.existsSync(finalPath) ? fs.readFileSync(finalPath, 'utf8') : null;
    if (rawFinal !== null) fs.chmodSync(finalPath, 0o400);
    if (!stop && exit.code === 0 && !completed) stop = 'missing-completion-event';
    if (!stop && exit.code === 0 && !finalHash) stop = 'missing-final-event';
    if (!stop && rawFinal !== null && finalHash !== sha(rawFinal)) stop = 'final-event-mismatch';
    return { cliVersion: agentCliVersion, modelRequested: MODEL, reasoningRequested: REASONING,
      argv: args, environmentKeys: Object.keys(env).sort(), exitCode: exit.code, signal: exit.signal,
      spawnError: exit.spawnError ?? null, stopReason: stop || stderrClass,
      elapsedMs: Math.round(performance.now() - started), eventCount, toolCount, usage, responseModel, rawFinal };
  } finally { fs.fsyncSync(fd); fs.closeSync(fd); fs.chmodSync(eventsPath, 0o400); }
}
