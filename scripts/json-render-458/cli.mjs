// Codex CLI transport. Tool execution is disabled in argv and any observed tool event stops the pilot.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { CLI_VERSION, MODEL, PER_ATTEMPT_TIMEOUT_MS, REASONING } from './plan.mjs';

export const DISABLED_FEATURES = Object.freeze([
  'shell_tool', 'unified_exec', 'code_mode_host', 'code_mode', 'apps', 'plugins', 'remote_plugin',
  'browser_use', 'browser_use_external', 'browser_use_full_cdp_access', 'computer_use', 'in_app_browser',
  'multi_agent', 'worktrees', 'hooks', 'skill_search', 'view_image', 'image_generation',
  'web_search_request', 'standalone_web_search', 'tool_suggest', 'goals', 'sleep_tool', 'deferred_executor',
]);
const sha = (value) => createHash('sha256').update(value).digest('hex');
const allowedEvents = new Set(['thread.started', 'turn.started', 'turn.completed', 'turn.failed', 'item.started', 'item.updated', 'item.completed', 'error']);
const allowedItems = new Set(['agent_message', 'reasoning']);

export function buildArgv({ cwd, schemaPath, finalPath }) {
  const args = ['exec', '--ignore-user-config', '--strict-config', '--ephemeral', '--skip-git-repo-check',
    '--sandbox', 'read-only', '--model', MODEL, '-c', `model_reasoning_effort="${REASONING}"`,
    '-c', 'mcp_servers={}', '-c', 'shell_environment_policy.inherit=none'];
  for (const feature of DISABLED_FEATURES) args.push('--disable', feature);
  return [...args, '--cd', cwd, '--json', '--output-schema', schemaPath, '--output-last-message', finalPath, '-'];
}
export function cleanEnv({ home, codexHome, nodeBin }) {
  if (!path.isAbsolute(home) || !path.isAbsolute(codexHome) || !path.isAbsolute(nodeBin)) throw new Error('Absolute clean environment paths required');
  return { HOME: home, CODEX_HOME: codexHome, PATH: `${nodeBin}:/usr/bin:/bin`, TERM: 'dumb', NO_COLOR: '1', LANG: 'en_US.UTF-8' };
}
export function sanitizeEvent(line) {
  let event;
  try { event = JSON.parse(line); } catch { throw new Error('malformed-event'); }
  if (!event || !allowedEvents.has(event.type)) throw new Error('unknown-event');
  const filtered = { type: event.type };
  if (event.type === 'thread.started') {
    if (typeof event.thread_id === 'string') filtered.threadId = event.thread_id;
  }
  if (event.type.startsWith('item.')) {
    const kind = event.item?.type;
    if (!allowedItems.has(kind)) throw new Error(`tool-or-unknown-item:${String(kind)}`);
    filtered.itemType = kind;
    if (kind === 'agent_message' && typeof event.item.text === 'string') {
      filtered.textBytes = Buffer.byteLength(event.item.text);
      filtered.textSha256 = sha(event.item.text);
    }
    // Reasoning payloads are deliberately not retained, even as hashes.
  }
  if (event.type === 'turn.completed' || event.type === 'turn.failed') {
    const usage = event.usage;
    if (usage && typeof usage === 'object') {
      filtered.usage = Object.fromEntries(Object.entries(usage).filter(([, value]) => Number.isFinite(value) && value >= 0));
    }
  }
  if (event.type === 'error' || event.type === 'turn.failed') {
    const message = String(event.message ?? event.error?.message ?? '');
    filtered.errorClass = /quota|rate.limit/i.test(message) ? 'quota' : /bill|credit|payment/i.test(message) ? 'billing' : /auth|login|credential/i.test(message) ? 'auth' : 'other';
  }
  if (typeof event.model === 'string') filtered.model = event.model;
  return filtered;
}
function stopGroup(child) {
  if (!child.pid) return;
  try { process.kill(-child.pid, 'SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch { /* already gone */ } }
  const timer = setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already gone */ } }, 2000);
  timer.unref();
}
export async function runCodex({ cliPath, cwd, home, codexHome, nodeBin, schemaPath, attemptDir, prompt, timeoutMs = PER_ATTEMPT_TIMEOUT_MS }) {
  if (fs.readdirSync(cwd).length) throw new Error('CLI cwd must be empty');
  if (fs.existsSync(path.join(cwd, 'AGENTS.md'))) throw new Error('CLI cwd contains AGENTS.md');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > PER_ATTEMPT_TIMEOUT_MS) throw new Error('Invalid timeout');
  const finalPath = path.join(attemptDir, 'raw-final.txt');
  const eventsPath = path.join(attemptDir, 'events.jsonl');
  if (fs.existsSync(finalPath) || fs.existsSync(eventsPath)) throw new Error('Attempt output already exists');
  const fd = fs.openSync(eventsPath, 'wx', 0o600);
  const args = buildArgv({ cwd, schemaPath, finalPath });
  const env = cleanEnv({ home, codexHome, nodeBin });
  const started = performance.now();
  let child;
  let pending = '';
  let stop = null;
  let usage = null;
  let responseModel = null;
  let eventCount = 0;
  let completed = false;
  let agentMessageHash = null;
  let stderrClass = null;
  try {
    child = spawn(cliPath, args, { cwd, env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const stopNow = (reason) => { if (!stop) { stop = reason; stopGroup(child); } };
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      pending += chunk;
      if (Buffer.byteLength(pending) > 1_000_000) return stopNow('event-buffer-limit');
      let split;
      while ((split = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0, split); pending = pending.slice(split + 1);
        if (!line.trim()) continue;
        try {
          const filtered = sanitizeEvent(line);
          if (filtered.model && filtered.model !== MODEL) return stopNow('model-drift');
          if (filtered.model) responseModel = filtered.model;
          if (filtered.usage) usage = filtered.usage;
          if (filtered.type === 'turn.completed') completed = true;
          if (filtered.itemType === 'agent_message' && filtered.type === 'item.completed') agentMessageHash = filtered.textSha256 ?? null;
          if (filtered.errorClass && ['quota', 'billing', 'auth'].includes(filtered.errorClass)) stopNow(filtered.errorClass);
          fs.writeSync(fd, JSON.stringify(filtered) + '\n'); fs.fsyncSync(fd); eventCount++;
        } catch (error) { stopNow(String(error.message).slice(0, 80)); }
      }
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      const message = String(chunk).slice(0, 16_384);
      if (/quota|rate.limit/i.test(message)) stderrClass = 'quota';
      else if (/bill|credit|payment/i.test(message)) stderrClass = 'billing';
      else if (/auth|login|credential/i.test(message)) stderrClass = 'auth';
    });
    child.stdin.end(prompt);
    const timer = setTimeout(() => stopNow('timeout'), timeoutMs);
    const exit = await new Promise((resolve) => {
      child.once('error', (error) => resolve({ code: null, signal: null, spawnError: error.code || 'spawn-error' }));
      child.once('exit', (code, signal) => resolve({ code, signal }));
    });
    clearTimeout(timer);
    if (pending.trim()) stop ||= 'incomplete-event-line';
    const rawFinal = fs.existsSync(finalPath) ? fs.readFileSync(finalPath, 'utf8') : null;
    if (rawFinal !== null) fs.chmodSync(finalPath, 0o400);
    if (!stop && exit.code === 0 && !completed) stop = 'missing-completion-event';
    if (!stop && exit.code === 0 && !agentMessageHash) stop = 'missing-final-event';
    if (!stop && rawFinal !== null && agentMessageHash !== sha(rawFinal)) stop = 'final-event-mismatch';
    return { cliVersion: CLI_VERSION, modelRequested: MODEL, reasoningRequested: REASONING, argv: args, environmentKeys: Object.keys(env).sort(),
      exitCode: exit.code, signal: exit.signal, spawnError: exit.spawnError ?? null, stopReason: stop || stderrClass,
      elapsedMs: Math.round(performance.now() - started), eventCount, usage, responseModel, rawFinal };
  } finally { fs.fsyncSync(fd); fs.closeSync(fd); fs.chmodSync(eventsPath, 0o400); }
}
