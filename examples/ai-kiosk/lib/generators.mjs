// Pluggable screen generators: generate({ prompt, facts, variant }) -> Promise<{ html, meta }>.
import { spawn as nodeSpawn } from 'node:child_process';
import os from 'node:os';

export const MODELS = ['haiku', 'sonnet', 'opus'];
export const MAX_OUTPUT = 512 * 1024;
export const DEFAULT_TIMEOUT_MS = 120_000;

/** Strip optional ``` fences a model may add despite instructions. */
export function extractFragment(text) {
  const t = String(text ?? '').trim();
  const m = t.match(/^```[a-z]*\s*\n([\s\S]*?)\n?```\s*$/i);
  return m ? m[1] : t;
}

/**
 * The real generator: one `claude -p` per screen. The argv is fixed (the model comes from a closed list checked
 * at construction), there is no shell, and the prompt goes over stdin, so nothing the model or the page sends
 * can reach the command line.
 */
export function claudeGenerator({ model = 'haiku', timeoutMs = DEFAULT_TIMEOUT_MS, maxOutput = MAX_OUTPUT, spawn = nodeSpawn } = {}) {
  if (!MODELS.includes(model)) throw new Error(`model must be one of ${MODELS.join(', ')}`);
  const argv = Object.freeze(['-p', '--model', model, '--output-format', 'json']);
  return {
    name: `claude:${model}`,
    argv,
    generate: ({ prompt }) => new Promise((resolve, reject) => {
      const started = Date.now();
      const child = spawn('claude', [...argv], { shell: false, cwd: os.tmpdir(), stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
      let out = ''; let err = ''; let done = false;
      const finish = (fn, v) => { if (!done) { done = true; clearTimeout(timer); fn(v); } };
      const timer = setTimeout(() => { child.kill('SIGKILL'); finish(reject, new Error(`claude timed out after ${timeoutMs} ms`)); }, timeoutMs);
      child.stdout.on('data', (d) => {
        out += d;
        if (out.length > maxOutput) { child.kill('SIGKILL'); finish(reject, new Error('claude output too large')); }
      });
      child.stderr.on('data', (d) => { if (err.length < 4096) err += d; });
      child.on('error', (e) => finish(reject, e));
      child.on('close', (code) => {
        if (code !== 0) return finish(reject, new Error(`claude exited ${code}: ${(err || out).slice(0, 300)}`));
        let j;
        try { j = JSON.parse(out); } catch { return finish(reject, new Error('claude returned non-JSON')); }
        if (j.is_error || typeof j.result !== 'string') return finish(reject, new Error('claude returned an error result'));
        finish(resolve, { html: extractFragment(j.result), meta: { ms: Date.now() - started, apiMs: j.duration_api_ms, costUsd: j.total_cost_usd, model } });
      });
      child.stdin.on('error', () => {}); // EPIPE if the child dies early; handled by 'close'
      child.stdin.end(prompt);
    }),
  };
}

// The stub generator (canned screens, no CLI) lives in stub.mjs.
export { stubScreen, stubGenerator } from './stub.mjs';
