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

// ---- stub: canned, persona-styled HTML built from the server facts (no CLI) ----
const THEMES = {
  senior: { wrap: 'min-h-screen bg-white text-black p-10 flex flex-col gap-8', h: 'text-5xl font-extrabold', btn: 'w-full rounded-xl border-4 border-black bg-yellow-300 px-8 py-6 text-3xl font-bold', alt: 'w-full rounded-xl border-4 border-black bg-white px-8 py-6 text-3xl', grid: 'flex flex-col gap-6' },
  regular: { wrap: 'min-h-screen bg-zinc-900 text-zinc-100 p-4 flex flex-col gap-3', h: 'text-lg font-semibold tracking-tight', btn: 'rounded-md bg-emerald-500 px-3 py-2 text-sm font-medium text-zinc-900', alt: 'rounded-md border border-zinc-700 px-3 py-2 text-sm', grid: 'grid grid-cols-3 gap-2' },
  family: { wrap: 'min-h-screen bg-gradient-to-b from-pink-100 to-sky-100 p-6 flex flex-col gap-5', h: 'text-4xl font-black text-fuchsia-600', btn: 'rounded-3xl bg-orange-400 px-6 py-5 text-2xl font-bold text-white shadow-lg', alt: 'rounded-3xl bg-white px-6 py-5 text-2xl text-sky-700 shadow', grid: 'grid grid-cols-2 gap-4' },
  foreign: { wrap: 'min-h-screen bg-slate-50 text-slate-800 p-6 flex flex-col gap-4', h: 'text-3xl font-bold text-indigo-700', btn: 'rounded-lg bg-indigo-600 px-5 py-4 text-xl text-white', alt: 'rounded-lg border border-indigo-200 bg-white px-5 py-4 text-xl', grid: 'grid grid-cols-2 gap-3' },
  none: { wrap: 'min-h-screen bg-amber-50 p-8 flex flex-col items-center justify-center gap-6', h: 'text-4xl font-bold text-amber-900', btn: 'rounded-full bg-amber-700 px-10 py-5 text-2xl text-white', alt: 'rounded-full border border-amber-700 px-6 py-4 text-xl', grid: 'grid grid-cols-2 gap-4' },
};
const won = (n) => `${n.toLocaleString('en-US')}원`;
const e = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function stubGenerator() {
  return {
    name: 'stub',
    generate: async ({ facts: f, menu, variant = 0 }) => {
      const t = THEMES[f.persona ?? 'none'];
      const b = (action, label, extra = '', cls = t.btn) => `<button class="${cls}" data-action="${action}"${extra}>${e(label)}</button>`;
      const flip = variant % 2 ? ' flex-col-reverse' : '';
      let body = '';
      switch (f.step) {
        case 'start': body = `<h1 class="${t.h}">Welcome</h1>${b('start', 'Touch to order')}`; break;
        case 'persona': body = `<h1 class="${t.h}">Who is ordering?</h1><div class="${t.grid}">${['senior', 'regular', 'family', 'foreign'].map((p) => b('choose-persona', p, ` data-option="${p}"`)).join('')}</div>`; break;
        case 'menu': body = `<h1 class="${t.h}">Menu (${e(f.context.weather)} ${e(f.context.daypart)})</h1><div class="${t.grid}">${menu.items.map((i) => b('select-item', `${i.name} ${won(i.price)}`, ` data-item="${i.id}"`, t.alt)).join('')}</div>${f.cart.length ? b('view-cart', `Cart (${f.cart.length})`) : ''}`; break;
        case 'options': body = `<h1 class="${t.h}">${e(f.current.name)} <span class="opacity-70">${won(f.current.price)}</span></h1><div class="${t.grid}">${f.current.sizes.map((z) => b('set-size', z.label, ` data-option="${z.id}"`, z.id === f.current.size ? t.btn : t.alt)).join('')}${f.current.offered.map((o) => b('toggle-option', o.label, ` data-option="${o.id}"`, f.current.options.includes(o.id) ? t.btn : t.alt)).join('')}</div>${b('add-to-cart', 'Add to cart')}${b('open-menu', 'Back', '', t.alt)}`; break;
        case 'cart': body = `<h1 class="${t.h}">Your order</h1><ul class="flex flex-col gap-2">${f.cart.map((l) => `<li class="flex justify-between items-center">${e(l.name)} ${e(l.size ?? '')} ${won(l.price)} ${b('remove-item', 'Remove', ` data-option="${l.index}"`, t.alt)}</li>`).join('')}</ul><p class="${t.h}">Total ${won(f.total)}</p>${b('checkout', 'Pay')}${b('open-menu', 'Add more', '', t.alt)}`; break;
        case 'pay': body = `<h1 class="${t.h}">Pay ${won(f.total)}</h1><p class="opacity-80">Demo only: nothing is charged.</p>${b('pay', 'Confirm payment')}${b('back', 'Back', '', t.alt)}`; break;
        case 'done': body = `<h1 class="${t.h}">Order #${f.orderNo}</h1><p class="text-xl">Thank you!</p>${b('restart', 'New order')}`; break;
      }
      return { html: `<main class="${t.wrap}${flip}">${body}</main>`, meta: { ms: 0, model: 'stub' } };
    },
  };
}
